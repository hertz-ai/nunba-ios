// Stories seed — intentionally empty. The Stories rail hides itself when
// the list is empty (`data.length === 0` early-return in
// ../components/FeedHeader/Stories/index.js). Real stories come in via
// the AddPostKey broadcast from Java (OnboardingModule) and are added to
// the map there. A previous static seed entry with `username: 'Loading'`
// was rendering as a permanent placeholder card in the rail — removed
// 2026-06-02 after the user reported the "Loading" card never
// disappearing.
export default [];
