use strict;
use warnings;
use Test::More tests => 14;
use File::Temp ();
use File::Spec ();
use FindBin ();
use lib "$FindBin::Bin/../lib";
use App::Envdoctor::Scanner;

my $src = <<'PERL';
# $ENV{COMMENTED}
my $db = $ENV{DB_URL};
my $port = $ENV{'PORT'};
=pod
$ENV{BLOCK_IGNORED}
=cut
my $host = $ENV{"HOST"};
PERL

my $used = App::Envdoctor::Scanner::scan_source( 'config.pl', $src );
is_deeply( [ sort keys %$used ], [qw(DB_URL HOST PORT)], 'detects $ENV{...} forms' );
ok( !exists $used->{COMMENTED},     'ignores line comments' );
ok( !exists $used->{BLOCK_IGNORED}, 'ignores POD blocks' );

my $dir = File::Temp->newdir;
open my $e, '>', File::Spec->catfile( "$dir", '.env' ) or die $!;
print {$e} "DB_URL=x\nUNUSED_KEY=1\n";
close $e;
open my $s, '>', File::Spec->catfile( "$dir", 'app.pl' ) or die $!;
print {$s} "\$ENV{DB_URL};\n\$ENV{NEW_FLAG};\n";
close $s;

my $findings = App::Envdoctor::Scanner::scan("$dir");
my %err  = map { $_->{name} => 1 } grep { $_->{severity} eq 'error' } @$findings;
my %warn = map { $_->{name} => 1 } grep { $_->{severity} eq 'warning' } @$findings;
ok( $err{NEW_FLAG},    'NEW_FLAG reported as error' );
ok( $warn{UNUSED_KEY}, 'UNUSED_KEY reported as warning' );
ok( !$err{DB_URL} && !$warn{DB_URL}, 'DB_URL reconciled' );

# duplicates + public-prefix
my $dir2 = File::Temp->newdir;
open my $e2, '>', File::Spec->catfile( "$dir2", '.env' ) or die $!;
print {$e2}
    "DUP_KEY=1\nSINGLE_KEY=2\nDUP_KEY=3\nNEXT_PUBLIC_API_KEY=x\nPUBLIC_URL=y\nAPI_KEY=z\nPUBLIC_KEY=k\n";
close $e2;
open my $s2, '>', File::Spec->catfile( "$dir2", 'app.pl' ) or die $!;
print {$s2}
    "\$ENV{DUP_KEY};\n\$ENV{SINGLE_KEY};\n\$ENV{NEXT_PUBLIC_API_KEY};\n\$ENV{PUBLIC_URL};\n\$ENV{API_KEY};\n\$ENV{PUBLIC_KEY};\n";
close $s2;

my $f2 = App::Envdoctor::Scanner::scan("$dir2");
my ($dup) = grep { $_->{rule} eq 'duplicates' && $_->{name} eq 'DUP_KEY' } @$f2;
ok( $dup, 'DUP_KEY reported as duplicates' );
is( $dup->{severity}, 'error', 'duplicates is an error' );
is( $dup->{message}, 'defined 2 times in the same file (lines 1, 3)',
    'duplicates message lists lines' );
ok( !( grep { $_->{rule} eq 'duplicates' && $_->{name} eq 'SINGLE_KEY' } @$f2 ),
    'single-definition key not reported as duplicate' );

my %pub = map { $_->{name} => 1 } grep { $_->{rule} eq 'public-prefix' } @$f2;
ok( $pub{NEXT_PUBLIC_API_KEY}, 'NEXT_PUBLIC_API_KEY flagged as public-prefix' );
ok( !$pub{PUBLIC_URL}, 'PUBLIC_URL not flagged' );
ok( !$pub{API_KEY}, 'bare API_KEY not flagged' );
ok( !$pub{PUBLIC_KEY}, 'PUBLIC_KEY not flagged (bare KEY excluded)' );
