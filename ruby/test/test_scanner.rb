# frozen_string_literal: true

require "minitest/autorun"
require "tmpdir"
require_relative "../lib/envdoctor/scanner"

class ScannerTest < Minitest::Test
  def test_detects_usage_and_ignores_comments
    src = <<~RUBY
      # ENV["COMMENTED"]
      db = ENV["DB_URL"]
      port = ENV.fetch("PORT")
      =begin
      ENV["BLOCK_IGNORED"]
      =end
      user = ENV['DB_USER']
    RUBY
    used = Envdoctor::Scanner.scan_source("app.rb", src)
    assert_equal %w[DB_URL DB_USER PORT], used.keys.sort
    refute used.key?("COMMENTED")
    refute used.key?("BLOCK_IGNORED")
  end

  def test_reconciles_missing_and_unused
    Dir.mktmpdir do |dir|
      File.write(File.join(dir, ".env"), "DB_URL=x\nUNUSED_KEY=1\n")
      File.write(File.join(dir, "app.rb"), "ENV[\"DB_URL\"]\nENV[\"NEW_FLAG\"]\n")
      findings = Envdoctor::Scanner.scan(dir)
      errors = findings.select { |f| f.severity == "error" }.map(&:name)
      warnings = findings.select { |f| f.severity == "warning" }.map(&:name)
      assert_includes errors, "NEW_FLAG"
      assert_includes warnings, "UNUSED_KEY"
      refute_includes errors, "DB_URL"
      refute_includes warnings, "DB_URL"
    end
  end

  def test_detects_duplicate_keys
    Dir.mktmpdir do |dir|
      File.write(File.join(dir, ".env"), "DUP=a\nSOLO=1\nDUP=b\n")
      File.write(File.join(dir, "app.rb"), "ENV[\"DUP\"]\nENV[\"SOLO\"]\n")
      findings = Envdoctor::Scanner.scan(dir)
      dup = findings.find { |f| f.rule == "duplicates" }
      refute_nil dup
      assert_equal "DUP", dup.name
      assert_equal "error", dup.severity
      assert_equal "defined 2 times in the same file (lines 1, 3)", dup.message
      # single-definition key not reported as duplicate
      refute(findings.any? { |f| f.rule == "duplicates" && f.name == "SOLO" })
      # duplicated-but-used var must NOT also be flagged unused/undefined
      refute(findings.any? { |f| f.name == "DUP" && %w[unused undefined-in-source].include?(f.rule) })
    end
  end

  def test_detects_public_prefix_secrets
    Dir.mktmpdir do |dir|
      File.write(File.join(dir, ".env"),
                 "NEXT_PUBLIC_API_KEY=x\nVITE_SECRET=y\nPUBLIC_URL=z\nAPI_KEY=w\nPUBLIC_KEY=k\n")
      findings = Envdoctor::Scanner.scan(dir)
      flagged = findings.select { |f| f.rule == "public-prefix" }.map(&:name)
      assert_includes flagged, "NEXT_PUBLIC_API_KEY"
      assert_includes flagged, "VITE_SECRET"
      refute_includes flagged, "PUBLIC_URL"
      refute_includes flagged, "API_KEY"
      refute_includes flagged, "PUBLIC_KEY"
      flagged.each do |name|
        f = findings.find { |x| x.rule == "public-prefix" && x.name == name }
        assert_equal "error", f.severity
      end
    end
  end
end
