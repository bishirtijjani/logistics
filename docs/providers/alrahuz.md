AUTHORIZATION API Key
Key Authorization
Value <value>
https://alrahuzdata.com.ng/api/user/
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
Example Request
Check user Detail
View More
javascript
var myHeaders = new Headers();
myHeaders.append("Authorization", "Token <ALRAHUZ_TOKEN>");
myHeaders.append("Content-Type", "application/json");

var raw = "";

var requestOptions = {
method: 'GET',
headers: myHeaders,
body: raw,
redirect: 'follow'
};

fetch("https://alrahuzdata.com.ng/api/user/", requestOptions)
.then(response => response.text())
.then(result => console.log(result))
.catch(error => console.log('error', error));

https://alrahuzdata.com.ng/api/data/
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
ALRAHUZDATA.COM.NG API DOCUMENTATION
ALRAHUZDATA.COM.NG API Doc Get your Token here https://alrahuzdata.com.ng/documentation/
GET Check user Detail
POST Buy Data
Content-Type application/json
Body raw

https://alrahuzdata.com.ng/api/data/
AUTHORIZATION API Key
Key Authorization
Value <value>
https://opendatasub.com/api/epin/
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
Body raw (json)
{"network": network_id,
"mobile_number": "09037346247",
"plan": plan_id,
"Ported_number":true}
GET Get All Data Transactions
POST Education Pin (WAEC/NECO/NABTEB)copy
json
{
"exam name": WAEC or NECO
https://alrahuzdata.com.ng/api/data/58
AUTHORIZATION API Key
Key Authorization
Value <value>
https://alrahuzdata.com.ng/api/topup/
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
Body raw
exam_name : WAEC or NECO,
"quantity": 1 (maximum is 5),
}
GET Query Data Transaction
POST Buy Airtime TopUp and Get all Airtime Transaction
{"network": network_id,
"amount" :amount,
"mobile_number": phone,
"Ported_number":true,
"airtime_type":"VTU"}
GET Query Airtime Transaction
https://alrahuzdata.com.ng/api/data/id
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
https://alrahuzdata.com.ng/api/epin/
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
Body raw (json)
POST Education Pin (WAEC/NECO/NABTEB)
json
{
"exam_name": WAEC or NECO,
"quantity": 1 (maximum is 5),
}
POST Buy Electricity Bill payment and Get all transaction
https://alrahuzdata.com.ng/api/billpayment/
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
Body raw
https://alrahuzdata.com.ng/api/billpayment/id
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
https://alrahuzdata.com.ng/api/cablesub/
AUTHORIZATION API Key
{ "disco_name": disco,
"amount" : amount to pay,
"meter_number": meter number,
"MeterType": meter type id (PREPAID:1,POSTAID:2) }
GET Query Bill Payment
POST Buy Cablesub angd get all transaction
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
Body raw
https://alrahuzdata.com.ng/api/cablesub/id
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
https://alrahuzdata.com.ng/api/validateiuc?smart_card_number=iuc&&cablename=id
AUTHORIZATION API Key
Key Authorization
Value <value>
{"cablename": cablename id,
"cableplan" :cableplan id,
"smart_card_number": meter}
GET Query Cablesub
GET Validate IUC
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
PARAMS
smart_card_number iuc
cablename id
https://alrahuzdata.com.ng/api/validatemeter?meternumber= meter&disconame=id&mtype=metertype
AUTHORIZATION API Key
Key Authorization
Value <value>
HEADERS
Authorization Token <ALRAHUZ_TOKEN>
Content-Type application/json
PARAMS
meternumber meter
disconame id
mtype metertype
GET Validate Meter
