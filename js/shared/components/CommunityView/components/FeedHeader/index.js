import React from 'react';
import ContextualFeedHeader from './ContextualFeedHeader';
import AddPost from './AddPost';
import Stories from './Stories';

const FeedHeader = () => {
  return (
    <>
      <ContextualFeedHeader />
      <AddPost />
      <Stories />
    </>
  );
};

export default FeedHeader;
export { default as ContextualFeedHeader } from './ContextualFeedHeader';
