// Registered through the shared makeMarkdownWrapMarkerSubParser factory (defined in
// emphasis.js): strong differs from its siblings only in the `**` wrap marker and its
// event family. Keeps its own registration and full three-phase event family.
showdown.subParser('makeMarkdown.strong', makeMarkdownWrapMarkerSubParser('strong', '**'));
