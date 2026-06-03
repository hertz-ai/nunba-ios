import {StyleSheet} from 'react-native';

const styles = StyleSheet.create({

  container: {
    borderBottomWidth: 4,
    borderColor: 'black',
    top:0
  },
  list: {
    paddingStart: 4,
    paddingEnd: 4,
    marginTop: 2,
    marginBottom: 5,
  },
  hr: {
    borderBottomWidth: 1,
    marginTop: 0,
    marginBottom: 0,
  },
  text: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 400,
    marginVertical: 4,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  // "STORIES" editorial header — uppercase + tracked-out, dimmed by
  // the theme override in index.js so the rail feels like a section
  // label not a tab title.  Gen-Z polish 2026-06-03.
  textR: {
    marginTop: 8,
    fontSize: 12,
    paddingHorizontal: 8,
    letterSpacing: 1.5,
    color: '#fff',
    fontWeight: '800',
  },
  // "Your story +" tile — matches StoryCard external dimensions (120
  // wide × 160 card + ~30 label) but uses a dashed-style placeholder
  // card with a centered purple-glow + icon so users immediately know
  // it's the "add" affordance.
  addContainer: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  addCard: {
    height: 160,
    width: 120,
    borderRadius: 14,
    backgroundColor: '#11131A',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  addIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  addLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    letterSpacing: 0.2,
  },
});

export default styles;
