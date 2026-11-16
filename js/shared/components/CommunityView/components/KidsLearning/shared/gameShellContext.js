/**
 * The context a kids game's host gives its template and shared widgets.
 *
 * Its own module so that anything can read it (FeedbackOverlay) or provide
 * it (GameShell, DynamicTemplateEngine's local mode) without importing the
 * whole shell -- GameShell pulls in its header and React Navigation.
 */
import {createContext, useContext} from 'react';

export const GameShellContext = createContext(null);

export const useGameShell = () => {
  const ctx = useContext(GameShellContext);
  if (!ctx) throw new Error('useGameShell must be used inside GameShell');
  return ctx;
};
