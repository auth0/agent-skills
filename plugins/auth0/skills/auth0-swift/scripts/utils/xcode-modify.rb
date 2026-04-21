#!/usr/bin/env ruby
# xcode-modify.rb
# Modifies an Xcode project using the xcodeproj gem:
#   1. Adds a file (Auth0.plist) to the main app target's Resources build phase.
#   2. Sets CODE_SIGN_ENTITLEMENTS on all target build configurations.
#
# Usage: ruby xcode-modify.rb <xcodeproj_path> <plist_abs_path> <entitlements_rel_path>

require 'pathname'

begin
  require 'xcodeproj'
rescue LoadError
  STDERR.puts "xcodeproj gem not found — install with: gem install xcodeproj"
  exit 2
end

xcodeproj_path, plist_abs_path, entitlements_rel_path = ARGV

project = Xcodeproj::Project.open(xcodeproj_path)
project_dir = Pathname.new(File.dirname(xcodeproj_path))

# Find the main application target (prefer .app product type, skip test targets)
target = project.native_targets.find { |t| t.product_type == "com.apple.product-type.application" }
target ||= project.native_targets.reject { |t| t.name.match?(/[Tt]est/) }.first
target ||= project.native_targets.first

if target.nil?
  STDERR.puts "No suitable target found in #{xcodeproj_path}"
  exit 1
end

# 1. Add Auth0.plist to target's Resources build phase
if plist_abs_path && !plist_abs_path.empty?
  plist_name = File.basename(plist_abs_path)
  plist_rel  = Pathname.new(plist_abs_path).relative_path_from(project_dir).to_s

  existing_ref = project.files.find { |f| File.basename(f.path.to_s) == plist_name }

  unless existing_ref
    existing_ref = project.main_group.new_file(plist_rel)
    existing_ref.source_tree = "SOURCE_ROOT"
    existing_ref.last_known_file_type = "text.plist.xml"
  end

  in_resources = target.resources_build_phase.files_references.any? { |f|
    File.basename(f.path.to_s) == plist_name
  }

  unless in_resources
    target.resources_build_phase.add_file_reference(existing_ref)
    puts "Added #{plist_name} to target #{target.name}"
  else
    puts "#{plist_name} already in target #{target.name}"
  end
end

# 2. Set CODE_SIGN_ENTITLEMENTS on all build configurations for this target
if entitlements_rel_path && !entitlements_rel_path.empty?
  target.build_configurations.each do |config|
    existing = config.build_settings["CODE_SIGN_ENTITLEMENTS"].to_s
    if existing.empty?
      config.build_settings["CODE_SIGN_ENTITLEMENTS"] = entitlements_rel_path
      puts "Set CODE_SIGN_ENTITLEMENTS=#{entitlements_rel_path} [#{config.name}]"
    else
      puts "CODE_SIGN_ENTITLEMENTS already set [#{config.name}]: #{existing}"
    end
  end
end

project.save
puts "done"
