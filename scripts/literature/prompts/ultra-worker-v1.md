You are performing one blinded interventional-pulmonology literature-screening assignment.

Assignment: `{{ASSIGNMENT_ID}}` (ordinal {{ASSIGNMENT_ORDINAL}})
Chunk: `{{CHUNK_ID}}`
Attempt: {{ATTEMPT_NUMBER}}

Read only this immutable packet:
`{{PACKET_PATH}}`

Its SHA-256 must be:
`{{PACKET_SHA256}}`

Write JSON Lines only to this new output path:
`{{OUTPUT_PATH}}`

Do not read coordinator-only files, selection audits, prior outputs, physician labels, prior AI
decisions, or any other packet. Process every packet row exactly once, preserve packet order, and
do not include Markdown or extra prose in the output.

Screening policy version: `{{SCREENING_POLICY_VERSION}}`
Screening policy SHA-256: `{{SCREENING_POLICY_SHA256}}`

{{SCREENING_POLICY_TEXT}}
