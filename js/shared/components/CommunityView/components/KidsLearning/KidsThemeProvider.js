import React, {createContext, useContext} from 'react';
import {StatusBar} from 'react-native';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows, CATEGORY_MAP} from '../../../../theme/kidsColors';

const KidsThemeContext = createContext({
  colors: kidsColors,
  spacing: kidsSpacing,
  borderRadius: kidsBorderRadius,
  fontSize: kidsFontSize,
  fontWeight: kidsFontWeight,
  shadows: kidsShadows,
  categories: CATEGORY_MAP,
});

export const useKidsTheme = () => useContext(KidsThemeContext);

const KidsThemeProvider = ({children}) => {
  const theme = {
    colors: kidsColors,
    spacing: kidsSpacing,
    borderRadius: kidsBorderRadius,
    fontSize: kidsFontSize,
    fontWeight: kidsFontWeight,
    shadows: kidsShadows,
    categories: CATEGORY_MAP,
  };

  return (
    <KidsThemeContext.Provider value={theme}>
      <StatusBar barStyle="dark-content" backgroundColor={kidsColors.background} />
      {children}
    </KidsThemeContext.Provider>
  );
};

export default KidsThemeProvider;
