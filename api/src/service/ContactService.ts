import FormData from 'form-data'; // form-data v4.0.1
import Mailgun from 'mailgun.js'; // mailgun.js v11.1.0
import { tool } from '@langchain/core/tools';

import { z } from 'zod';

export interface IContactService {
  createTool(): ReturnType<typeof tool>;
  send(message: string, fromAddress: string): void;
}

export class MailgunContactService implements IContactService {
  contactSchema = z.object({
    senderEmail: z.string().describe('The email of the user sending the message.'),
    message: z.string().describe('The message to send.'),
  });

  createTool(): ReturnType<typeof tool> {
    return tool(
      async ({ senderEmail, message }) => {
        try {
          await this.send(message, senderEmail);
          return 'Email sent successfully.';
        } catch (error) {
          return 'Failed to send email. Try again later.';
        } finally {
        }
      },
      {
        name: 'contactRequestForm',
        description: 'If the user asks to contact/leave a message, call contactRequestForm.',
        schema: this.contactSchema,
      }
    );
  }

  async send(message: string, fromAddress: string): Promise<void> {
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY ?? '',
    });
    const data = await mg.messages.create('mail.proxie.chat', {
      from: 'Proxie <postmaster@mail.proxie.chat>',
      to: ['Karl <karlgarske@gmail.com>'],
      subject: `New Message From Proxie User '${fromAddress}'`,
      text: `${fromAddress} said:\n${message}`,
    });

    console.log(data); // logs response data
  }
}
