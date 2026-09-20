Drop proposal JSON files here before a maintainer moves them to
`accepted.json` or `rejected.json`. The web form never writes this
directory; it opens a GitHub issue and copies JSON for the queue.

Each file is one object:

```json
{
  "outlet_key": "NJ0003-002",
  "kind": "service",
  "value": "notary",
  "evidence_url": "https://example.org/notary",
  "submitter_contact": null
}
```

Kinds: `service` | `hours` | `resource`. No ratings, stars, or reviews.
