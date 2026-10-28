# Privacy Policy

Last updated: 29 October 2026

This policy covers Brofessor as it exists in this repository. If you run your own copy, you are responsible for how your deployment handles data.

## What Brofessor processes

- **Topics and lesson settings** you enter (topic, level, length, language). These are sent to the backend to generate a lesson.
- **Uploaded material** (PDF, PPT, notes, photos), once upload support is enabled. Its content is extracted and used only to build your lesson.
- **Your IP address**, held in memory by the backend for rate limiting (default: 20 lessons per IP per hour). It is not written to disk.

Brofessor has no accounts and does not ask for your name, email or any other personal details.

## Third-party AI providers

To generate a lesson, the backend sends your topic, settings and any extracted material to the configured LLM provider (Google Gemini or an OpenAI-compatible API, set by `BROFESSOR_PROVIDER`). That provider's own privacy policy applies to the data it receives. In `replay` mode nothing is sent to any provider.

Do not upload material that contains personal, confidential or sensitive information.

## What is stored

- Generated lessons are cached on the server as JSON (the lesson plus metadata such as title, subject, topic, level, language, model and creation time) so the same topic can be replayed without calling the AI again.
- Cached lessons may appear in the public list of recent lessons served by `/api/lessons`. Do not put anything private in a topic.
- Uploaded files are not kept after the lesson is generated.

## Cookies and tracking

Brofessor uses no cookies, analytics or advertising trackers.

## Removal requests

To have a cached lesson removed, email **vsuryansh080405@gmail.com** with the lesson title or id.

## Changes

Changes to this policy are made in this file and are visible in its commit history.
