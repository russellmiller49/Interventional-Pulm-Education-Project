-- The EUS-B Simulator joins the development beta hub, so its feedback must be storable.
-- Every earlier module ID stays valid, including retired Therapeutic Bronchoscopy reports.
alter table public.module_beta_feedback
  drop constraint module_beta_feedback_module_id_check;
alter table public.module_beta_feedback
  add constraint module_beta_feedback_module_id_check check (module_id in (
    'ebus-guided', 'eus-b-simulator', 'therapeutic-bronchoscopy', 'synchronized-anatomy',
    'branch-tracing', 'live-anatomy', 'peripheral-imaging', 'bronchoscopy-foundations', 'devices',
    'cardiohelp-ecmo', 'baxter-crrt', 'icu-hemodynamics', 'mechanical-ventilation',
    'mechanical-circulatory-support'
  ));
notify pgrst, 'reload schema';
