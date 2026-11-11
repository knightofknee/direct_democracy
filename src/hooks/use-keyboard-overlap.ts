import { useEffect, useState, type RefObject } from 'react';
import { Dimensions, Keyboard, Platform, TextInput, type KeyboardEvent, type ScrollView, type View } from 'react-native';

/** Where the keyboard's top edge was last seen, in screen points. */
let keyboardTop: number | null = null;

/**
 * How far the on-screen keyboard overlaps a view, on Android only. Give it
 * to that view as bottom padding and its scroll view shrinks above the
 * keyboard, so the page can scroll the focused field into view.
 *
 * Why: Android used to resize the window for the keyboard (`adjustResize`),
 * but apps drawn edge to edge (the default from Android 15, and on for this
 * app) keep their full height, so the keyboard simply covers the bottom of
 * the page. Found on the Android emulator 2026-11-11: the police district
 * address field and its button disappeared under the keyboard. iOS gets the
 * same room from `automaticallyAdjustKeyboardInsets` on the ScrollView.
 *
 * The overlap is measured against the view's place on screen, so it is
 * right under a header, above a tab bar, or in a dialog.
 */
export function useKeyboardOverlap(ref: RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const top = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _w, h) => setOverlap(Math.max(0, Math.round(y + h - top))));
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);
  return overlap;
}

/**
 * When the keyboard opens, scroll so the focused field and some room under
 * it, for the button that usually follows it, sit above the keyboard. Both
 * platforms only do half of this on their own: Android brings the field's
 * bottom edge to the keyboard's top, and iOS (found on the simulator
 * 2026-11-11, in the report dialog) showed only the note field's top line,
 * with Send covered. Does nothing when the field is already comfortably in
 * view, so a tap on a field high on the page never moves it.
 */
export function useRevealFocusedField(
  scrollRef: RefObject<ScrollView | null>,
  /** The ScrollView's content (its `innerViewRef`), where scroll offsets are measured. */
  contentRef: RefObject<View | null>,
  /**
   * A view whose bottom edge is the bottom of the screen, given when the
   * page may sit in an iOS sheet. Positions inside a sheet are measured from
   * the sheet's top, which is below the screen's, while the keyboard's
   * position is in screen points; this view's bottom tells the two apart.
   * Found on the simulator 2026-11-11: sign-in's Enter stayed half hidden.
   */
  sheetRef?: RefObject<View | null>,
  room = 88
): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Moving from one field to the next with the keyboard already open sends
    // no keyboard event, so while it is open the focused field is checked
    // four times a second; a new one gets the same treatment.
    let watch: ReturnType<typeof setInterval> | undefined;
    let lastInput: unknown = null;
    const reveal = () => {
      const scroll = scrollRef.current;
      const frame = scroll?.getNativeScrollRef();
      const input = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!scroll || !frame || !input || !content || keyboardTop == null) return;
      lastInput = input;
      const screenTop = keyboardTop;
      const measure = (offset: number) =>
        frame.measureInWindow((_sx, sy, _sw, sh) => {
          const top = screenTop - offset;
          // The keyboard's edge, not the scroll view's measured bottom: on
          // Android the view may not have finished shrinking yet, and on iOS
          // it never shrinks (the keyboard is an inset).
          const visibleBottom = Math.min(sy + sh, top);
          input.measureInWindow((_ix, iy, _iw, ih) => {
            if (iy >= sy && iy + ih + room <= visibleBottom) return;
            // Fails, harmlessly, for a screen that does not hold the field
            // (another tab's screen also hears the keyboard).
            input.measureLayout(
              content,
              (_lx, ly, _lw, lh) => {
                scroll.scrollTo({ y: Math.max(0, ly + lh + room - (visibleBottom - sy)), animated: true });
              },
              () => {}
            );
          });
        });
      const sheet = sheetRef?.current;
      if (Platform.OS === 'ios' && sheet) {
        sheet.measureInWindow((_x, y, _w, h) => measure(Math.max(0, Dimensions.get('window').height - (y + h))));
      } else {
        measure(0);
      }
    };
    const shown = (e: KeyboardEvent) => {
      keyboardTop = e.endCoordinates.screenY;
      clearTimeout(timer);
      // A moment for the page to make its room (padding on Android, the
      // keyboard inset on iOS) before measuring.
      timer = setTimeout(reveal, 80);
      if (watch == null) {
        watch = setInterval(() => {
          const now = TextInput.State.currentlyFocusedInput();
          if (now && now !== lastInput) reveal();
        }, 250);
      }
    };
    const show = Keyboard.addListener('keyboardDidShow', shown);
    // iOS grows the keyboard after it opens (the Passwords bar over a
    // password field): measure again whenever its top edge moves while it is
    // open. Android sends keyboardDidShow again for that instead.
    const change = Keyboard.addListener('keyboardDidChangeFrame', (e) => {
      if (keyboardTop != null && e.endCoordinates.screenY !== keyboardTop) shown(e);
    });
    const stopWatching = () => {
      clearInterval(watch);
      watch = undefined;
      lastInput = null;
    };
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop = null;
      clearTimeout(timer);
      stopWatching();
    });
    return () => {
      clearTimeout(timer);
      stopWatching();
      show.remove();
      change.remove();
      hide.remove();
    };
  }, [scrollRef, contentRef, sheetRef, room]);
}
