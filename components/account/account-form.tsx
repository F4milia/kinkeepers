"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { RadioPillGroup } from "@/components/ui/radio-pill-group";
import { COPY } from "@/lib/copy";
import {
  updateAccountInfo,
  updateNotificationPreferences,
  requestDataExport,
  requestAccountDeletion,
  signOut,
} from "@/lib/account/actions";
import type { MyAccount, ContactChannel } from "@/lib/account/data";

// Same 4 IANA zones as components/referral/intake-form.tsx's own
// TIME_ZONE_OPTIONS (not imported - that file doesn't export it, and this
// screen doesn't otherwise depend on L2's intake form). Keep both lists in
// sync if a region is ever added, same note that file's own comment makes.
const TIME_ZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: COPY.referral.field.contact_email },
  { value: "sms", label: COPY.referral.field.contact_sms },
  { value: "both", label: COPY.referral.field.contact_both },
];

export function AccountForm({ account }: { account: MyAccount }) {
  const [firstName, setFirstName] = useState(account.firstName);
  const [lastName, setLastName] = useState(account.lastName);
  const [email, setEmail] = useState(account.email ?? "");
  const [phone, setPhone] = useState(account.phone ?? "");
  const [timeZone, setTimeZone] = useState(account.timeZone ?? TIME_ZONE_OPTIONS[0].value);
  const [channel, setChannel] = useState<ContactChannel>(account.preferredContactChannel);

  const [infoSaved, setInfoSaved] = useState(false);
  const [channelSaved, setChannelSaved] = useState(false);
  const [exportRequested, setExportRequested] = useState(false);
  const [deletionRequested, setDeletionRequested] = useState(false);

  const [infoPending, startInfoTransition] = useTransition();
  const [channelPending, startChannelTransition] = useTransition();
  const [exportPending, startExportTransition] = useTransition();
  const [deletionPending, startDeletionTransition] = useTransition();
  const [signOutPending, startSignOutTransition] = useTransition();

  function saveInfo() {
    setInfoSaved(false);
    startInfoTransition(async () => {
      const result = await updateAccountInfo({ firstName, lastName, email, phone, timeZone });
      if (result.success) setInfoSaved(true);
    });
  }

  function saveChannel(next: ContactChannel) {
    setChannel(next);
    setChannelSaved(false);
    startChannelTransition(async () => {
      const result = await updateNotificationPreferences(next);
      if (result.success) setChannelSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-section">
      <Card>
        <div className="flex flex-col gap-4">
          <TextField label={COPY.referral.field.first_name} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <TextField label={COPY.referral.field.last_name} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <TextField label={COPY.referral.field.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label={COPY.referral.field.phone} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex flex-col gap-2">
            <span className="text-label font-ui text-ink">{COPY.referral.field.time_zone}</span>
            <RadioPillGroup
              name="time-zone"
              label={COPY.referral.field.time_zone}
              options={TIME_ZONE_OPTIONS}
              value={timeZone}
              onChange={(value) => setTimeZone(value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveInfo} loading={infoPending}>
              {COPY.account.save}
            </Button>
            {infoSaved && !infoPending ? <span className="text-meta font-ui text-ink-soft">{COPY.account.saved}</span> : null}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-label font-ui text-ink">{COPY.account.notification_preferences_title}</h2>
          <p className="text-meta font-ui text-ink-soft">{COPY.account.notification_preferences_explain}</p>
          <RadioPillGroup
            name="notification-channel"
            label={COPY.account.notification_preferences_title}
            options={CHANNEL_OPTIONS}
            value={channel}
            onChange={(value) => saveChannel(value as ContactChannel)}
          />
          {channelPending ? <span className="text-meta font-ui text-ink-soft">{COPY.loading}</span> : null}
          {channelSaved && !channelPending ? <span className="text-meta font-ui text-ink-soft">{COPY.account.saved}</span> : null}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            loading={exportPending}
            disabled={exportRequested}
            onClick={() =>
              startExportTransition(async () => {
                const result = await requestDataExport();
                if (result.success) setExportRequested(true);
              })
            }
          >
            {COPY.account.request_export}
          </Button>
          {exportRequested ? <p className="text-meta font-ui text-ink-soft">{COPY.account.request_confirmation}</p> : null}

          <Button
            variant="destructive"
            loading={deletionPending}
            disabled={deletionRequested}
            onClick={() =>
              startDeletionTransition(async () => {
                const result = await requestAccountDeletion();
                if (result.success) setDeletionRequested(true);
              })
            }
          >
            {COPY.account.request_deletion}
          </Button>
          {deletionRequested ? <p className="text-meta font-ui text-ink-soft">{COPY.account.request_confirmation}</p> : null}
        </div>
      </Card>

      <Button variant="quiet" loading={signOutPending} onClick={() => startSignOutTransition(() => signOut())}>
        {COPY.account.sign_out}
      </Button>
    </div>
  );
}
