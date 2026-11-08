# Release procedure and external prerequisites

Release source: https://github.com/Holly86/ioBroker.adaptivehome
Built package: GitHub prerelease 0.1.0-beta.1, separate from npm and ioBroker latest/stable.

1. Run type/lint/unit/package/controller/browser/frozen-artifact checks. Inspect actual git diff,
   all new files, commit authors, package whitelist and support export. Run scripts/public-review.cjs.
2. Align package/io-package versions and README changelog; build; npm pack. Inspect tar contents and
   licenses. Store SHA-256 and test the exact frozen bytes in the isolated controller.
3. Push reviewed source. Require actual CI outcomes, create an immutable version tag and a GitHub
   prerelease with built tgz/checksums and explicit external limitations. Never substitute the source
   zip for the built package. Do not move a released tag to silently replace code.
4. npm publication needs an authenticated maintainer and appropriate publishing rights. No npm account
   is authenticated in this execution environment, so npm publication is pending. When ready, publish
   the checked package with the beta dist-tag; configure trusted publishing where supported. Add the
   ioBroker organization as package owner as required for catalog entry.
5. Run the official adapter checker against the public repository, address findings, arrange broader
   beta testing and request latest inclusion through the ioBroker repositories process. Stable follows
   successful latest/user testing and maintainer approval. No external catalog approval is implied.

Current upstream references reviewed on 2026-11-08:
[repository requirements](https://github.com/ioBroker/ioBroker.repositories#requirements-for-an-adapter-to-get-added-to-the-beta-latest-repository),
[publishing guidance](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterpublish.md),
[installation CLI](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/config/cli.md).
Repository name/case, package name, MIT license, English README/changelog, manufacturer/backend links,
metadata roles, JSON Admin, CI and topics are prepared. npm ownership and latest/stable acceptance
are external gates. Compatibility testing remains specific to backend version, firmware and model.
