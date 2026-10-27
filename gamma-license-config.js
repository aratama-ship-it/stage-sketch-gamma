/* Public trust configuration only. Deployment must pin issuer + ES256 public JWKs
   here AND in the Mac bundle (GammaLicenseConfiguration). No production defaults.
   Never put a private JWK, password or Cookie in this asset. */
if (!globalThis.GAMMA_LICENSE_CONFIG) globalThis.GAMMA_LICENSE_CONFIG = Object.freeze({
  required: false, issuer: '', keys: Object.freeze({})
});
