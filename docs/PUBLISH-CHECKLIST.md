# Publish Checklist

Steps to publish `modular-studio` to npm.

## Pre-publish

- [ ] Ensure `npm run build:all` passes
- [ ] Ensure `npx vitest run` passes
- [ ] Verify `node dist-server/bin/modular-studio.js --help` prints usage
- [ ] Confirm version in `package.json` is correct (`0.1.0`)
- [ ] Confirm `README.md` is up to date
- [ ] Confirm `LICENSE` file exists

## Publish

- [ ] `npm login` (if not already authenticated)
- [ ] `npm publish --access public`
- [ ] Verify install works: `npx modular-studio --help`

## Post-publish

- [ ] Create GitHub release with tag `v0.1.0`
  ```
  git tag v0.1.0
  git push origin v0.1.0
  ```
  Then create release at https://github.com/VictorGjn/modular-patchbay/releases/new
- [ ] Update README badges:
  - npm version: `[![npm](https://img.shields.io/npm/v/modular-studio)](https://www.npmjs.com/package/modular-studio)`
  - license: `[![license](https://img.shields.io/npm/l/modular-studio)](./LICENSE)`
- [ ] Test `npx modular-studio --open` from a clean directory
- [ ] Announce on socials / relevant channels
