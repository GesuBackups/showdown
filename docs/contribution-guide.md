If you wish to contribute, this is your starting point.

This document contains guidelines to help you make your contribution clear and consistent.
These guidelines also help us to review your PR faster and, as a result, will give you
appropriate credit in your GitHub profile.

If you have time to contribute to this project, we are happy to give you credit for it.

We thank you in advance for your contribution!

### Architecture principles

The converter is built around five principles. Keep any contribution aligned with them:

1. **One code path.** Every flavor (`original`, `vanilla`, `commonmark`, `gfm`) runs the same parsers. Express a flavor difference as an option gate inside the parser, never as a second engine for the same construct.
2. **The subparser is the unit of design.** Each subparser enables one syntax construct and keeps its recognition, rendering, events, and option gates together in one file.
3. **Helpers earn their keep by reuse.** Add a shared helper only when it has at least two genuine call sites; otherwise inline it into its single caller. Anything that enables a piece of syntax belongs in a subparser.
4. **Direction over local optimization.** Prefer the change that keeps the code aligned with these principles over one that only trims lines locally.
5. **Every spec syntax element has an owning subparser.** If a spec gives a construct its own section, a registered subparser owns it — recognition, rendering, events, and gates.

### Features

You can request a new feature by submitting an issue. If you would like to implement a new feature,
feel free to issue a Pull Request.

### Pull requests

Pull Requests (PRs) are awesome. Get familiar with the following guidelines before you begin:

1. Search the project for a Pull Request related to your submission. You don't want to duplicate effort.
1. A PR that contains code changes should be created from a git branch based on **develop**:

    ```bash
    git checkout -b my-fix-branch develop
    ```

1. Follow our [coding style rules][coding-rules].
1. Run full test suite and ensure all tests pass.
    1. If some tests fail, ensure that you follow [coding style rules][coding-rules].
1. One PR - one issue. Refrain from fixing multiple issues in the same pull request. Several small PRs are preferable instead of a big one.
1. If the PR introduces a new feature or fixes an issue, **please add the appropriate test case(s)**.
1. Follow [conventional commit guidelines][conventional-commits] for your commit message(s) when saving changes in your branch and PR.
1. Add your name to the [Credits](credits.md) file. We like to give credit where it's due.

1. If we suggest changes:
    1. Make the required updates.
    1. Re-run test suite to ensure tests are still green.
    1. Rebase your branch and force push to your GitHub repository (this will update your Pull Request):

        ```bash
        git rebase develop -i
        git push origin my-fix-branch -f
        ```

1. After your pull request is merged, you can safely delete your branch.


[coding-rules]: https://github.com/showdownjs/code-style/blob/master/README.md
[conventional-commits]: https://www.conventionalcommits.org/

