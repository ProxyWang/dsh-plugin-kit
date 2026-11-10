import React from "react";

// Destructured into module-local bindings (instead of re-exporting the import
// bindings) so the bundled call sites stay `h(…)` / `useState(…)` verbatim,
// exactly like the hand-written bundle this replaced.
const { createElement: h, Fragment, useState, useEffect, useRef, useCallback, useMemo } = React;

export { React, h, Fragment, useState, useEffect, useRef, useCallback, useMemo };
