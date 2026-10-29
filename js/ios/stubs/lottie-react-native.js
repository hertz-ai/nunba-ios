/**
 * Stand-in for lottie-react-native, which the iOS app does not ship.
 *
 * The only importer is the vendored KidsCanvas, and it renders Lottie only for
 * animations added through registerLottie(). Nothing registers one (on Android
 * either), so this component is never mounted; it exists so Metro can bundle.
 * Add the real pod and drop this stub (and its metro.config.js entry) once a
 * Lottie animation is registered.
 */
const LottieView = () => null;

export default LottieView;
