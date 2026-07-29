# Remix of Remix of Remix of Remix of Remix of Route Harmony

https://github.com/supportnetapp-coder/routenet.git IMPORTANT: This project is a REPOSITORY IMPORT, not a new application.

Your task is to use ONLY the code contained in the repository I provide.

STRICT REQUIREMENTS

1. Do NOT create a new project.

2. Do NOT replace existing code with templates.

3. Do NOT generate placeholder pages.

4. Do NOT redesign the application.

5. Do NOT remove any existing features.

6. Do NOT change the project architecture unless required to fix a bug.

7. Preserve the folder structure exactly as it exists.

8. Reuse all existing components, hooks, utilities, services, assets, and APIs.

9. Every page must come from the repository itself.

ROUTES

• Discover every route automatically.

• Ensure every existing route is registered.

• Restore any missing routes.

• Fix broken routing.

• Verify nested routes.

• Verify dynamic routes.

• Verify protected routes.

• Verify layouts.

• Verify redirects.

• Verify 404 handling.

• Ensure every route loads successfully without blank pages.

PAGES

Scan the entire repository and make sure EVERY page included in the repository is accessible.

Do not leave orphan pages.

Do not ignore unused pages.

Every page that belongs to the application should have a working route.

AUDIO PLAYER

The audio player is a core feature.

Ensure:

• Audio playback works on desktop and mobile.

• Play works.

• Pause works.

• Resume works.

• Next works.

• Previous works.

• Seeking works.

• Progress updates correctly.

• Duration displays correctly.

• Buffering is handled.

• Volume works.

• Mute works.

• Repeat works.

• Shuffle works if implemented.

• Queue works.

• Playlist switching works.

• Background playback continues while navigating.

• State persists across routes.

• No duplicate players are created.

• Audio does not stop when changing pages.

• Metadata updates while songs change.

• Album artwork updates correctly.

• Loading errors are handled gracefully.

DEEZER METADATA

Use the existing Deezer metadata integration already present in the repository.

Do NOT replace it.

Ensure:

• Track titles load correctly.

• Artist names load correctly.

• Album names load correctly.

• Album artwork loads correctly.

• Genre loads if available.

• Release date loads if available.

• Duration loads correctly.

• Search results use Deezer metadata.

• Missing metadata is handled gracefully.

• Rate limits and failed requests are handled properly.

• Metadata is cached where appropriate.

• Existing API keys and endpoints remain unchanged.

CODEBASE

Before making changes:

• Scan 100% of the repository.

• Understand all files.

• Index every component.

• Index every route.

• Index every API.

• Index every hook.

• Index every utility.

• Index every service.

• Index every context.

• Index every state store.

• Index every layout.

Then reuse those files instead of creating duplicates.

Do not introduce duplicate components when an equivalent already exists.

QUALITY CHECK

Before finishing, verify:

✓ Every page opens.

✓ Every route works.

✓ No blank screens.

✓ No missing imports.

✓ No broken navigation.

✓ No console errors.

✓ No TypeScript errors.

✓ No build errors.

✓ No runtime errors.

✓ Audio playback functions correctly.

✓ Deezer metadata works correctly.

✓ Existing functionality remains intact.

FINAL RULE

Treat the repository as the single source of truth.

If a feature already exists in the repository, reuse and repair it instead of rewriting it.

The final application should behave exactly like the repository, with only bug fixes and missing functionality restored—not a newly generated application.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://routenet.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/38ce4b3e-9a12-4d14-86fd-4549b583ac78).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
