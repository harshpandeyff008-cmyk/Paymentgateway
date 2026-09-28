import React from 'react';
import PublicStore from './PublicStore';

/**
 * User Dashboard Component
 * Directly presents the official dealsbyshiv store experience,
 * enhanced with user authentication, "Become a Client" license upgrade modal,
 * pre-filled checkout, and direct logout.
 */
export default function UserDashboard() {
  return <PublicStore isUserDashboard={true} />;
}
