package App::Envdoctor::Scanner;

# Core scanner: reconcile %ENV access in Perl source against .env definitions.
# Local-first — no network, values never printed.

use strict;
use warnings;
use File::Find ();
use File::Spec ();

our $VERSION = '0.1.0';

my @USAGE = ( qr/\$ENV\{\s*["']?([A-Za-z_]\w*)["']?\s*\}/ );

sub _blank {
    my $s = shift;
    $s =~ s/[^\n]/ /g;
    return $s;
}

sub strip_noise {
    my ($code) = @_;
    # POD blocks: =word ... =cut
    $code =~ s/(^=\w+.*?^=cut[^\n]*)/_blank($1)/gems;
    # line comments
    $code =~ s/(#[^\n]*)/_blank($1)/ge;
    return $code;
}

sub scan_source {
    my ( $path, $content ) = @_;
    my $text = strip_noise($content);
    my %used;
    for my $re (@USAGE) {
        while ( $text =~ /$re/g ) {
            my $name  = $1;
            my $start = pos($text) - length($&);
            next if exists $used{$name};
            my $pre = substr( $text, 0, $start );
            my $line = ( $pre =~ tr/\n// ) + 1;
            $used{$name} = { file => $path, line => $line };
        }
    }
    return \%used;
}

# Collect ALL occurrences per key within a single file, in order.
# Returns { KEY => [ line1, line2, ... ] }.
sub parse_env {
    my ( $path, $content ) = @_;
    my %def;
    my $i = 0;
    for my $raw ( split /\n/, $content, -1 ) {
        $i++;
        my $t = $raw;
        $t =~ s/^\s+|\s+$//g;
        next if $t eq '' || $t =~ /^#/;
        if ( $raw =~ /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/ ) {
            push @{ $def{$1} }, $i;
        }
    }
    return \%def;
}

my @PUBLIC_PREFIXES = qw(
    NEXT_PUBLIC_ VITE_ REACT_APP_ EXPO_PUBLIC_
    GATSBY_ NUXT_PUBLIC_ VUE_APP_ PUBLIC_
);

sub _is_public_secret {
    my ($name) = @_;
    my $has_prefix = 0;
    for my $p (@PUBLIC_PREFIXES) {
        if ( index( $name, $p ) == 0 ) { $has_prefix = 1; last; }
    }
    return 0 unless $has_prefix;
    return $name =~ /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH/i
        ? 1
        : 0;
}

sub _read {
    my ($file) = @_;
    open my $fh, '<', $file or die "cannot read $file: $!";
    local $/;
    my $data = <$fh>;
    close $fh;
    return $data;
}

sub _rel {
    my ( $root, $path ) = @_;
    return File::Spec->abs2rel( $path, $root );
}

sub _find_files {
    my ( $root, $want ) = @_;
    my @out;
    File::Find::find(
        sub {
            return unless -f $_;
            my $full = $File::Find::name;
            return if $full =~ m{/(?:\.git|blib|node_modules)/};
            my $name = $_;
            if ( $want eq 'env' ) {
                push @out, $full
                    if $name eq '.env'
                    || ( $name =~ /^\.env\./ && $name !~ /\.example$/ );
            }
            elsif ( $name =~ /\.p[lm]$/ ) {
                push @out, $full;
            }
        },
        $root
    );
    return sort @out;
}

sub scan {
    my ($root) = @_;
    my ( %def, %used, @dupes );

    for my $f ( _find_files( $root, 'env' ) ) {
        my $rel = _rel( $root, $f );
        my $d = parse_env( $rel, _read($f) );
        for my $key ( keys %$d ) {
            my @lines = @{ $d->{$key} };
            # First occurrence counts as the definition for reconciliation.
            $def{$key} //= { file => $rel, line => $lines[0] };
            if ( @lines >= 2 ) {
                push @dupes,
                    {
                    rule     => 'duplicates',
                    severity => 'error',
                    name     => $key,
                    message  => 'defined '
                        . scalar(@lines)
                        . ' times in the same file (lines '
                        . join( ', ', @lines ) . ')',
                    origin => { file => $rel, line => $lines[0] },
                    };
            }
        }
    }
    for my $f ( _find_files( $root, 'perl' ) ) {
        my $u = scan_source( _rel( $root, $f ), _read($f) );
        $used{$_} //= $u->{$_} for keys %$u;
    }

    my @findings;
    for my $name ( sort keys %used ) {
        next if exists $def{$name};
        push @findings,
            {
            rule     => 'undefined-in-source',
            severity => 'error',
            name     => $name,
            message  => 'used in source code but not defined in any environment file',
            origin   => $used{$name},
            };
    }
    for my $f ( sort { $a->{name} cmp $b->{name} } @dupes ) {
        push @findings, $f;
    }
    for my $name ( sort keys %def ) {
        next unless _is_public_secret($name);
        push @findings,
            {
            rule     => 'public-prefix',
            severity => 'error',
            name     => $name,
            message  => 'secret-looking variable is exposed to client bundles via a public prefix',
            origin   => $def{$name},
            };
    }
    for my $name ( sort keys %def ) {
        next if exists $used{$name};
        push @findings,
            {
            rule     => 'unused',
            severity => 'warning',
            name     => $name,
            message  => 'defined but never referenced in source',
            origin   => $def{$name},
            };
    }
    return \@findings;
}

1;
