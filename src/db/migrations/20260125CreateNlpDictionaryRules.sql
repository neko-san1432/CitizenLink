-- Migration: Create NLP Dictionary Rules Table
-- Description: Stores DB-backed patterns for Brain dictionary sections (speculation, negation, severity, temporal)
-- Date: 2026-01-25

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'nlp_dictionary_rule_type'
  ) THEN
    CREATE TYPE public.nlp_dictionary_rule_type AS ENUM (
      'speculation_conditional',
      'speculation_risk',
      'speculation_past',
      'severity_amplifier',
      'severity_diminisher',
      'negation_no_issue',
      'temporal_present',
      'temporal_past',
      'temporal_future'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.nlp_dictionary_rules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  rule_type public.nlp_dictionary_rule_type NOT NULL,
  pattern text NOT NULL,
  translation text,
  multiplier numeric,
  action text,
  is_current_emergency boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT nlp_dictionary_rules_pkey PRIMARY KEY (id),
  CONSTRAINT nlp_dictionary_rules_unique UNIQUE (rule_type, pattern)
);

CREATE INDEX IF NOT EXISTS idx_nlp_dictionary_rules_type ON public.nlp_dictionary_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_nlp_dictionary_rules_pattern ON public.nlp_dictionary_rules(pattern);

