import { doc } from 'firebase/firestore';
import React, { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Field } from '@/components/ui';
import { useLiveDoc } from '@/hooks/use-firestore';
import { db } from '@/lib/firebase';
import { useT } from '@/lib/i18n';
import { notify, notifyError } from '@/lib/notify';
import type { ElectionAnswer, UserProfile } from '@/lib/types';
import { answerElectionQuestion } from '@/services/election';

/** The candidate's one answer: post it once, revise it any time. */
export function ElectionAnswerComposer({
  profile,
  questionId,
  bare,
}: {
  profile: UserProfile;
  questionId: string;
  /** Inside another card (the command center): no card of its own. */
  bare?: boolean;
}) {
  const t = useT();
  const { data: mine } = useLiveDoc<ElectionAnswer>(
    () => doc(db, 'electionQuestions', questionId, 'answers', profile.uid),
    [questionId, profile.uid]
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const text = draft ?? mine?.body ?? '';

  const save = async () => {
    setSaving(true);
    try {
      await answerElectionQuestion(profile, questionId, text, mine != null);
      setDraft(null);
      notify(t(mine ? 'Answer updated' : 'Answer posted'), t('Voters see every answer side by side.'));
    } catch (e) {
      notifyError(t('Could not save your answer'), e);
    } finally {
      setSaving(false);
    }
  };

  const Wrap = bare ? React.Fragment : Card;
  return (
    <Wrap>
      <ThemedText type="smallBold" style={{ fontSize: 13 }}>
        {mine ? t('Your answer (one per candidate - edits replace it)') : t('Your answer')}
      </ThemedText>
      <Field
        placeholder={t('Answer the city yourself, on the record…')}
        value={text}
        onChangeText={setDraft}
        multiline
        maxLength={4000}
      />
      <Button
        title={mine ? t('Update answer') : t('Post answer')}
        onPress={save}
        loading={saving}
        disabled={!text.trim() || (mine != null && text.trim() === mine.body)}
      />
      {mine && (
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 12 }}>
          {t('Answers are part of the public record; revise the text, but it cannot be taken down.')}
        </ThemedText>
      )}
    </Wrap>
  );
}
