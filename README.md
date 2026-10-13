<p align="center">
  <img src="banner.jpg" alt="PharmReach" width="160">
</p>

# PharmReach
HackRU 2026 at Rutgers University, developed in 24 hours<br>
This branch is the static version of `main`, adapted for GitHub Pages.<br>
[pharmreach.tech](https://pharmreach.tech)

## What it does

PharmReach allows people to search for a medicine. Then, it will show the pharmacies near them with that product available, it will show the price, the location of the pharmacy, and the time it takes to travel there for a variety of travel methods. It provides a total cost of the transportation trip along with the price of the medication itself.

## Inspiration

I, Aidan, moved to Hoboken as a student at Stevens Institute of Technology. Currently, I’m on Accutane, meaning I must pick up a script monthly. As I’m now in an area I’m unfamiliar with, getting a monthly script can be difficult to coordinate, especially since I do not have a car. Accutane causes other side effects too, meaning it wasn’t just Accutane I had to pick up. A fully-implemented website like PharmReach would make my situation extremely easier.

## How we built it

At first, we did research on a term called Pharmacy Deserts, which we learned are areas where there aren’t a lot of pharmacy locations. This makes it difficult for people without cars or those who are low-income to get access to potentially critical medication.

From there, we did market research on where these areas are, and found out that New Jersey hugely qualifies as a Pharmacy Desert in certain places due to the mismatch in human population with pharmacy population.

We then researched and compiled 6 databases of pharmacies, along with specific details about those pharmacies, and searched for the availability of certain medications for each of those pharmacies, then we input that into a map along with transportation data.

### Built With

- Gemini
- OpenStreetMap
- OpenTripPlanner
- Python
- React

## Accomplishments

- Open Trip Planner (OTP) capability finds the best route based on transportation needs. It is consistent with Google and Apple Maps.
- Gemini chat integration, which allows users to talk to it about their symptoms, which it will then recommend certain medications and the specific links of that medication on local pharmacy websites.
- Efficient interactive map that shows pharmacy locations.

## Challenges

Getting the data for the stock of medicines/products in each pharmacy. It took a long time to get price data then eventually add it into the website.

## What we learned

Lack of API availability for pharmacies like CVS and Walgreens made it difficult to gather data for their stock and prices. So, we had to gather our own data looking through their websites to check the prices and stock of each of the medicines we wanted PharmReach to show in this early stage.

## PharmReach potential

Expanding the scope–right now it is limited to a small number of pharmacies, so adding more into our dataset would be the next step as it has limited use.

## Disclaimer

_Updated October 13, 2026_

### Medical emergencies

**PharmReach is not responsible or liable for any medical emergency.** If you or someone else may be having a medical emergency, call 911 or go to the nearest emergency room. For a mental health or suicide crisis, call or text 988. Always rely on emergency services, never on this website or its medication helper.

### Not medical advice

PharmReach is not a pharmacy, doctor, or healthcare provider, and it does not sell medicine. Information on this site, including product suggestions, is general information about over-the-counter products and is not medical advice, diagnosis, or treatment. It does not consider your health history, allergies, or other medicines. Read the product label and ask a pharmacist or doctor if you are unsure whether a product is right for you.

### Medication helper

**The medication helper on this site is not AI.** It is a simple algorithm that looks for keywords, like “headache” or “heartburn”, in what you type and points to matching products from a fixed list of over-the-counter products. It does not understand context, negation, or your health history, and it can miss or misread what you type. Its suggestions are not a recommendation for you. The helper screens for some emergency and pharmacist-only words, but it will not catch everything.

### Proof of concept, local area only

PharmReach is mostly a proof of concept built at HackRU 2026. This is a static copy of the site that runs entirely in your browser. It covers a limited number of CVS and Walgreens locations in Hoboken and nearby Hudson County, New Jersey only, and a limited list of products. It is not a complete or authoritative directory of pharmacies, products, or prices.

### Where the data comes from

Prices, stock, store details, and hours were obtained through automated collection (web scraping) and manual collection from the public websites of local Hoboken-area pharmacies. They are point-in-time snapshots, may be out of date or incorrect, and online prices can differ from in-store prices. Confirm price and availability with the pharmacy before you travel.

### Data is not real-time

**Pharmacy and transit data was last updated October 8, 2026.** PharmReach does not pull real-time data, so prices, stock, store hours, and transit schedules may be out of date. Check with the pharmacy and the transit agency before you go.

### Travel times and costs

On this version of the site, walking, cycling, and driving times are rough estimates calculated from straight-line distance, not live routes, and transit trips are not planned. Real travel times and costs will differ. Use the Google Maps link for current directions before you travel.

### No affiliation

PharmReach is an independent student project. It is not affiliated with, endorsed by, or sponsored by CVS Health, Walgreens, NJ TRANSIT, Google, or any product manufacturer. Store names, product names, and brands are trademarks of their respective owners and are used only to identify them.

### No warranty

PharmReach is provided “as is” and “as available”, without warranties of any kind, express or implied, including accuracy, availability, or fitness for a particular purpose. To the fullest extent permitted by law, the PharmReach team is not liable for any loss, injury, or damage arising from use of, or reliance on, this website or its information. Links to other websites are provided for convenience; we are not responsible for their content.

### Contact

Questions or corrections: [d9hhhh@gmail.com](mailto:d9hhhh@gmail.com). Do not include medical information.
