-- Keep historical Therapeutic Bronchoscopy reports reviewable, but the application no
-- longer offers that module for testing. EBUS Guided must accept live feedback too.
alter table public.module_beta_feedback
  drop constraint module_beta_feedback_module_id_check;
alter table public.module_beta_feedback
  add constraint module_beta_feedback_module_id_check check (module_id in (
    'ebus-guided', 'therapeutic-bronchoscopy', 'synchronized-anatomy', 'branch-tracing',
    'live-anatomy', 'peripheral-imaging', 'bronchoscopy-foundations', 'devices',
    'cardiohelp-ecmo', 'baxter-crrt', 'icu-hemodynamics', 'mechanical-ventilation',
    'mechanical-circulatory-support'
  ));
notify pgrst, 'reload schema';
