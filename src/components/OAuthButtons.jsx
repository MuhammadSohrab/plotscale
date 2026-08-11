import { cloudSyncService } from "../services/CloudSyncService";

const providers = [
  { id: "google", label: "Google", logo: "https://cdn.simpleicons.org/google" },
  { id: "apple", label: "Apple", logo: "https://cdn.simpleicons.org/apple/000000" },
  { id: "facebook", label: "Facebook", logo: "https://cdn.simpleicons.org/facebook" },
];

export function OAuthButtons({ onError, disabled }) {
  const authenticate = async (provider) => {
    try {
      await cloudSyncService.signInWithOAuth(provider);
    } catch (error) {
      onError(error.message);
    }
  };

  return (
    <>
      <div className="divider">
        <span />
        <small>or continue with</small>
        <span />
      </div>
      <div className="oauth-grid">
        {providers.map(({ id, label, logo }) => (
          <button
            className="oauth-button"
            type="button"
            key={id}
            aria-label={`Continue with ${label}`}
            title={`Continue with ${label}`}
            disabled={disabled}
            onClick={() => authenticate(id)}
          >
            <img src={logo} alt="" width="21" height="21" aria-hidden="true" />
          </button>
        ))}
      </div>
    </>
  );
}
