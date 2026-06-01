import React, {createContext, useContext} from 'react';
import {StatusBar} from 'react-native';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows, CATEGORY_MAP} from '../../../../theme/kidsColors';

// Stable theme object — referenced from both the default context value
// and the provider so identity never changes across renders.  The
// previous implementation rebuilt the theme object on every render,
// pushing a new context value each time and triggering a re-render of
// every consumer (including GameShell), which starved the JS event
// loop enough that the loading→intro setTimeout in GameShell never
// fired and every kids game hung on the loading skeleton forever.
// On-device evidence 2026-06-01 Galaxy S23 Ultra.
const KIDS_THEME = {
  colors: kidsColors,
  spacing: kidsSpacing,
  borderRadius: kidsBorderRadius,
  fontSize: kidsFontSize,
  fontWeight: kidsFontWeight,
  shadows: kidsShadows,
  categories: CATEGORY_MAP,
};

const KidsThemeContext = createContext(KIDS_THEME);

export const useKidsTheme = () => useContext(KidsThemeContext);

const KidsThemeProvider = ({children}) => {
  return (
    <KidsThemeContext.Provider value={KIDS_THEME}>
      <StatusBar barStyle="dark-content" backgroundColor={kidsColors.background} />
      {children}
    </KidsThemeContext.Provider>
  );
};

export default KidsThemeProvider;
