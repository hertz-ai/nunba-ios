import React from 'react';
import ContextualFeedHeader from './ContextualFeedHeader';
import AddPost from './AddPost';
import Stories from './Stories';
import MarketingFunnelCard from './MarketingFunnelCard';
import RoleGuard from '../RoleGuard';

const FeedHeader = () => {
  return (
    <>
      <ContextualFeedHeader />
      {/* #184 mobile parity — funnel tile above the feed so the user
          sees channel-by-channel download conversion on the first
          page they land on, same as the web /admin/dashboard card.
          On web this tile lives at /admin/dashboard behind
          <RoleGuard minRole="guest"> (per Nunba MainRoute.js:594).
          Mobile-side we gate to `central` because the mobile feed
          doesn't have a dedicated /admin route — only the platform
          admin should see the tile inline above their personal feed.
          Other users see nothing here.  Verified on-device 2026-05-28
          where the card was visible to the non-admin author. */}
      <RoleGuard minRole="central">
        <MarketingFunnelCard />
      </RoleGuard>
      <AddPost />
      <Stories />
    </>
  );
};

export default FeedHeader;
export { default as ContextualFeedHeader } from './ContextualFeedHeader';
export { default as MarketingFunnelCard } from './MarketingFunnelCard';
