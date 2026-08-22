# frozen_string_literal: true

module Envdoctor
  # Core scanner: reconcile ENV usage in Ruby source against .env definitions.
  # Local-first — no network, values never printed.
  module Scanner
    module_function

    USAGE_PATTERNS = [
      /\bENV\[\s*["']([A-Za-z_]\w*)["']\s*\]/,
      /\bENV\.fetch\(\s*["']([A-Za-z_]\w*)["']/
    ].freeze

    ENV_LINE = /\A\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/.freeze

    PUBLIC_PREFIXES = %w[
      NEXT_PUBLIC_ VITE_ REACT_APP_ EXPO_PUBLIC_ GATSBY_ NUXT_PUBLIC_ VUE_APP_ PUBLIC_
    ].freeze

    SECRET_RE = /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|CREDENTIAL|API_?KEY|ACCESS_?KEY|AUTH/i.freeze

    Origin = Struct.new(:file, :line)
    Finding = Struct.new(:rule, :severity, :name, :message, :origin)

    # Blank comments and =begin/=end blocks, preserving line structure.
    def strip_noise(code)
      code = code.gsub(/^=begin\b.*?^=end\b[^\n]*/m) { |m| m.gsub(/[^\n]/, " ") }
      code.gsub(/#[^\n]*/) { |m| " " * m.length }
    end

    def scan_source(path, content)
      text = strip_noise(content)
      used = {}
      USAGE_PATTERNS.each do |re|
        text.to_enum(:scan, re).each do
          match = Regexp.last_match
          name = match[1]
          next if used.key?(name)

          line = text[0...match.begin(0)].count("\n") + 1
          used[name] = Origin.new(path, line)
        end
      end
      used
    end

    # Returns { name => [Origin, ...] } with ALL occurrences per key in order.
    def parse_env(path, content)
      defined = {}
      content.split("\n").each_with_index do |raw, i|
        stripped = raw.strip
        next if stripped.empty? || stripped.start_with?("#")

        if (m = raw.match(ENV_LINE))
          (defined[m[1]] ||= []) << Origin.new(path, i + 1)
        end
      end
      defined
    end

    def public_prefix?(name)
      PUBLIC_PREFIXES.any? { |p| name.start_with?(p) } && SECRET_RE.match?(name)
    end

    def discover_env_files(root)
      files = Dir.glob(File.join(root, ".env"))
      files += Dir.glob(File.join(root, ".env.*")).reject { |f| f.end_with?(".example") }
      files.sort
    end

    def discover_source_files(root)
      Dir.glob(File.join(root, "**", "*.rb")).reject do |p|
        p.split(File::SEPARATOR).any? { |part| %w[.git vendor node_modules].include?(part) }
      end.sort
    end

    def scan(root)
      defined = {}
      dup_findings = []
      discover_env_files(root).each do |f|
        rel = relative(root, f)
        parse_env(rel, File.read(f)).each do |name, origins|
          if origins.length >= 2
            lines = origins.map(&:line)
            dup_findings << Finding.new("duplicates", "error", name,
                                        "defined #{origins.length} times in the same file " \
                                        "(lines #{lines.join(', ')})",
                                        origins.first)
          end
          # First occurrence (first file wins) counts as the definition.
          defined[name] ||= origins.first
        end
      end

      used = {}
      discover_source_files(root).each do |f|
        scan_source(relative(root, f), File.read(f)).each { |k, v| used[k] ||= v }
      end

      findings = []
      used.keys.sort.each do |name|
        next if defined.key?(name)

        findings << Finding.new("undefined-in-source", "error", name,
                                "used in source code but not defined in any environment file",
                                used[name])
      end
      dup_findings.sort_by(&:name).each { |finding| findings << finding }
      defined.keys.sort.each do |name|
        next unless public_prefix?(name)

        findings << Finding.new("public-prefix", "error", name,
                                "secret-looking variable is exposed to client bundles " \
                                "via a public prefix", defined[name])
      end
      defined.keys.sort.each do |name|
        next if used.key?(name)

        findings << Finding.new("unused", "warning", name,
                                "defined but never referenced in source", defined[name])
      end
      findings
    end

    def relative(root, path)
      path.sub(/\A#{Regexp.escape(root)}#{Regexp.escape(File::SEPARATOR)}?/, "")
    end
  end
end
