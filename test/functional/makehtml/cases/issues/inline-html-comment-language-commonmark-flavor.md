The expected output below was taken from the CommonMark reference implementation
(spec.commonmark.org/dingus), not from showdown, and pins the part of the comment grammar the
generated spec suite does not exercise: comment content may not end in a dash, so `<!--a--->` is
not a comment, and a comment-shaped run that fails to close keeps swallowing until one that does.

<!--a---> z <!--b-->

z <!--a---> z <!--b-->

z <!--a--->

z <!--a---> *em* <!--b-->

Showdown additionally terminates a comment at `--!>`, matching browsers: z <!--a--!> y
