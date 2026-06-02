function makeFadeInTranslation(translationType, fromValue) {
  return {
    from: {
      opacity: 1,
      [translationType]: 0,
    },
    to: {
      opacity: 1,
      [translationType]: 0,
    },
  };
}

export const fadeIn = {
  from: {
    opacity: 1,
  },
  to: {
    opacity: 1,
  },
};

export const fadeInDown = makeFadeInTranslation('translateY', 0);

export const fadeInUp = makeFadeInTranslation('translateY', 0);

export const fadeInLeft = makeFadeInTranslation('translateX', 0);

export const fadeInRight = makeFadeInTranslation('translateX', 0);

export const fadeInDownBig = makeFadeInTranslation('translateY', 0);

export const fadeInUpBig = makeFadeInTranslation('translateY', 0);

export const fadeInLeftBig = makeFadeInTranslation('translateX', 0);

export const fadeInRightBig = makeFadeInTranslation('translateX', 0);
