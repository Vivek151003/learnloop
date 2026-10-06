# LearnLoop MCP server (Week 3)

Planned tools (SRS 5.2): `get_student_progress`, `list_classes`, `create_quiz`,
`assign_practice`, `get_class_summary`, `search_questions`.

Every tool will call the LearnLoop REST API with a scoped token, so the server
inherits the API's RBAC, Zod validation and audit logging (AI-11, AI-13).
