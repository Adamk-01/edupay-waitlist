import Image from "next/image";

/**
 * Product screenshots shown in the hero.
 *
 * The previous version built these "screens" out of HTML and CSS, which meant
 * the hero advertised invented content (a fake wallet balance, fake order
 * cards). These are real screenshots from the EduPay app.
 *
 * Dimensions come from the source images (562 x 1280, a 1:2.28 portrait) and
 * are passed explicitly so the browser can reserve space and the hero does not
 * shift while the images load.
 */
export function PhoneMockups() {
  return (
    <div className="phone-stage">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />

      <div className="phone phone-home">
        <Image
          src="/edupay-screen-1.jpg"
          alt="The EduPay app home screen, listing education services"
          width={562}
          height={1280}
          priority
          sizes="(max-width: 700px) 138px, 176px"
          className="phone-screen-image"
        />
      </div>

      <div className="phone phone-orders">
        <Image
          src="/edupay-screen-2.jpg"
          alt="The EduPay app showing the progress of a service request"
          width={562}
          height={1280}
          sizes="(max-width: 700px) 138px, 176px"
          className="phone-screen-image"
        />
      </div>

      <div className="float-chip chip-secure">Secure &amp; reliable</div>
      <div className="float-chip chip-track">Track your requests</div>
    </div>
  );
}
