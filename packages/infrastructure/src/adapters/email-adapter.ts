import { EmailIngestAdapter, EmailMetadata } from '@kanbax/domain';
import * as crypto from 'crypto';

export class DefaultEmailIngestAdapter implements EmailIngestAdapter {
    async extractMetadata(payload: any): Promise<EmailMetadata> {
        const { subject, sender, receivedAt, messageId } = payload;

        // Data minimization: Hash the messageId and ensure no body is processed
        const hashedMessageId = crypto.createHash('sha256').update(messageId).digest('hex');
        const senderDomain = sender.split('@')[1] || 'unknown';

        return {
            messageId: hashedMessageId,
            subject,
            sender,
            senderDomain,
            receivedAt: new Date(receivedAt),
        };
    }
}
