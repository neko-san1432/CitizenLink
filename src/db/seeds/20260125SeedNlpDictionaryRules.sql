INSERT INTO public.nlp_dictionary_rules (rule_type, pattern, translation)
VALUES
  ('speculation_conditional', 'baka', 'maybe'),
  ('speculation_conditional', 'siguro', 'probably'),
  ('speculation_conditional', 'kung', 'if'),
  ('speculation_risk', 'posible', 'possible'),
  ('speculation_past', 'kahapon', 'yesterday');

INSERT INTO public.nlp_dictionary_rules (rule_type, pattern, action, translation)
VALUES
  ('negation_no_issue', 'wala naman', 'filter_out', 'no issue'),
  ('negation_no_issue', 'okay na', 'filter_out', 'already ok');

INSERT INTO public.nlp_dictionary_rules (rule_type, pattern, multiplier, translation)
VALUES
  ('severity_amplifier', 'sobrang', 1.2, 'very'),
  ('severity_amplifier', 'delikado', 1.3, 'dangerous'),
  ('severity_diminisher', 'konti', 0.85, 'a little');

INSERT INTO public.nlp_dictionary_rules (rule_type, pattern)
VALUES
  ('temporal_present', 'ngayon'),
  ('temporal_past', 'kanina'),
  ('temporal_future', 'bukas');

