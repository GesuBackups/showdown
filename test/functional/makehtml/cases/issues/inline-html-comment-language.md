A comment ends at the first `-->` whose leading dash run is aligned: x <!-- ok --> y

The comment-end-bang form terminates too: x <!--a--!> y

Both empty forms are comments: x <!--> y and x <!---> y

Content may not end in a dash, so this is not a comment: x <!--a---> y

An unterminated opener is not a comment either: x <!--unterminated y

A non-comment run does not swallow the markdown after it: x <!--a---> *em* <!--b-->

A real comment does swallow it: x <!-- a *em* b --> y

Two comment-shaped runs in one paragraph: z <!--a---> z <!--b-->

<!--a---> z <!--b-->
