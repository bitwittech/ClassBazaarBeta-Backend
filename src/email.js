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

const send = ({ name, email, subject, message }) => {
  const textBody = `Name: ${name}   
                Subject: ${subject}             
                Email: ${email}
                Body: ${message}
                This email came ClassBazaar.com Contact Us Page.`;

  const from = name && email ? `${name} <${email}>` : `${name || email}`;

  const msg = {
    from,
    to: 'mehtarajb@gmail.com',
    cc: 'chaks.gautam@gmail.com, classbazaarco@gmail.com',
    subject: subject,
    text: textBody,
    replyTo: from,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(msg, (error, info) =>
      error ? reject(error) : resolve(info),
    );
  });
};

module.exports = send;
