const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

const transporter = nodemailer.createTransport(
  sgTransport({
    auth: {
      api_key:
        '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',
    },
  }),
);

const send = ({ name, email, phone, subject, text }) => {
  const textBody = `Name: ${name}   
                Subject: ${subject}             
                Email: ${email}
                Phone: ${phone}
                Body: ${text}
                This email came from scrapejob.api React.js & Next.js template
                `;

  const from = name && email ? `${name} <${email}>` : `${name || email}`;

  const message = {
    from,
    to: 'chakshu@samagragovernance.in',
    cc: 'iamanshulmalik@gmail.com',
    subject: subject,
    text: textBody,
    replyTo: from,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(message, (error, info) =>
      error ? reject(error) : resolve(info),
    );
  });
};

module.exports = send;
