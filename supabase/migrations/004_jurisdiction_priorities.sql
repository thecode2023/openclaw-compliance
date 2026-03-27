-- Add jurisdiction_priorities JSONB column to user_profiles
-- Shape: { "EU": "active", "US-CA": "monitoring", "SG": "expansion" }
-- Values: "active" | "monitoring" | "expansion"
-- Default: empty object (existing jurisdictions default to "active" in app logic)

ALTER TABLE user_profiles ADD COLUMN jurisdiction_priorities JSONB DEFAULT '{}';
