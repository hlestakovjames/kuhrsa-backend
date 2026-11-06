ALTER TABLE "Notification"
ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "Notification_organizationId_channel_readAt_createdAt_idx"
ON "Notification"("organizationId", "channel", "readAt", "createdAt");
