import React from 'react';
import ServerDrivenUI from '../CommunityView/components/KidsLearning/ServerDrivenUI';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../../theme/colors';

const socialTokens = {
  colors,
  spacing,
  borderRadius,
  fontSizes: fontSize,
  fontWeights: fontWeight,
  shadows,
};

export default function SocialLiquidUI({ layout, data, onAction, style }) {
  return (
    <ServerDrivenUI
      layout={layout}
      data={data}
      onAction={onAction}
      style={style}
      themeTokens={socialTokens}
    />
  );
}

export { socialTokens };
