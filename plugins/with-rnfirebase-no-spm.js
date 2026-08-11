const { withPodfile } = require('expo/config-plugins');

/**
 * react-native-firebase v26.1+ resolves the Firebase iOS SDK via Swift
 * Package Manager by default, which is incompatible with the static
 * frameworks this project uses (expo-build-properties useFrameworks:
 * 'static', required by RNFirebase's own CocoaPods setup). This flag opts
 * back into CocoaPods-resolved Firebase, per RNFirebase's install error
 * message. Revisit when moving to dynamic frameworks or Expo drops
 * CocoaPods (Firebase stops publishing pods after Oct 2026).
 */
/**
 * Second workaround, same theme: FirebaseAppCheck 12.15+ ships an iOS
 * reCAPTCHA provider whose Swift half (GACRecaptchaProvider) is present in
 * the AppCheckCore pod archive but NOT in its compiled sources (podspec only
 * globs *.[mh]), so the pod cannot compile under CocoaPods. This app never
 * uses reCAPTCHA on iOS (App Attest / debug only), so the provider's sources
 * are dropped from the FirebaseAppCheck target. Remove when the upstream
 * podspec compiles its Swift sources.
 */
const STRIP_RECAPTCHA = `
    installer.pods_project.targets.each do |t|
      next unless t.name == 'FirebaseAppCheck'
      t.source_build_phase.files.to_a.each do |bf|
        path = bf.file_ref&.real_path.to_s
        t.source_build_phase.remove_build_file(bf) if path.include?('RecaptchaProvider')
      end
    end
`;

module.exports = function withRNFirebaseNoSPM(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (!contents.includes('$RNFirebaseDisableSPM')) {
      contents = '$RNFirebaseDisableSPM = true\n' + contents;
    }
    if (!contents.includes('RecaptchaProvider')) {
      contents = contents.replace(
        /post_install do \|installer\|/,
        'post_install do |installer|' + STRIP_RECAPTCHA
      );
    }
    config.modResults.contents = contents;
    return config;
  });
};
