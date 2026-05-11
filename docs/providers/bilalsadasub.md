Introduction
Dashboard
Home

Introduction

Welcome to the BILALSADASUB ! You can use our API to access BILALSADASUB API endpoints, which can be use to purchase any of our services, and breeds in our database.

We have language bindings in PHP, Ruby, Python, react js and JavaScript! You can use any programming language of your choice to connect to our endpoints.

This BILALSADASUB API documentation page was created to assits you through the integration proccess.

Thanks.
NB:
Authentication

How to Generate (TOKEN)

The Basic Authentication Is Use To Generate (TOKEN)
It should be passed as a concatenated string like this username:password
Please use the following details for authentication
Username: Your BILALSADASUB Username
Password: Your BILALSADASUB Password
convert it to base64(username:password) use it to gerenerate token

Enpoint URL

https://bilalsadasub.com/api/user
Code Sample

                 $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, "https://bilalsadasub.com/api/user");
                curl_setopt($ch, CURLOPT_POST, 1);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
                curl_setopt(
                   $ch, CURLOPT_HTTPHEADER, [
                        "Authorization: Basic ".base64_encode('username:password'),
                    ]
                );
                $json = curl_exec($ch);
                curl_close($ch);

Expected Response

                {
                    "status": "success",
                    "AccessToken": "4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                    "balance": "0.00",
                    "username": "bishirtm101"
                }

Data Subscription API
Dashboard
Home

This section contains the recommended flow for integrating Data Subscription services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB Data Subscription Payment RESTful API, the endpoints below applies:

network
phone
data_plan
bypass (boolean)
request-id (unique)
Network Plan
MTN
1
GLO
3
AIRTEL
2
9MOBILE
4
Dense padding
Rows per page:

5
1–4 of 4

Data Plans
1
MTN SME 500MB ₦310.00 30days
2
MTN SME 1GB ₦399.00 7 days
3
MTN SME 2GB ₦899.00 Monthly
4
MTN SME 3GB ₦1,350.00 30days
5
MTN SME 5GB ₦1,805.00 30days
Dense padding
Rows per page:

5
1–5 of 158

PURCHASE PRODUCT

Using a POST method, Data bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/data
Code Sample

                $paypload = array(
                    'network' => 1,
                     'phone' => 09063503232,
                     'data_plan' => 1,
                     'bypass' => false,
                     'request-id' => Data_12345678900);
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/data');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "network": "MTN",
                    "request-id": "Data_1234567890",
                    "amount": "100",
                    "dataplan": "500MB",
                    "status": "success",
                    "message": "Yello! You have gifted 500MB to 2347013397088. Share link https://mtnapp.page.link/myMTNNGApp with 2347013397088 to download the new MyMTN app for exciting offers.",
                    "phone_number": "07013397088",
                    "oldbal": "110325",
                    "newbal": 110225,
                    "system": "API",
                    "plan_type": "GIFTING",
                    "wallet_vending": "wallet"
                }

Airtime Subscription API
Dashboard
Home

This section contains the recommended flow for integrating Airtime Subscription services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB Airtime Subscription Payment RESTful API, the endpoints below applies:

network
phone
plan_type
amount
bypass (boolean)
request-id (unique)
Network Plan
MTN
1
GLO
3
AIRTEL
2
9MOBILE
4
Dense padding
Rows per page:

5
1–4 of 4

PURCHASE PRODUCT

Using a POST method, Airtime purchase can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/topup/
Code Sample

                $paypload = array(
                    'network' => 1,
                     'phone' => 09063503232,
                     'plan_type' => 'VTU',
                     'bypass' => false,
                     'amount' => 100,
                     'request-id' => Airtime_12345678900);
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/topup');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "network": "MTN",
                    "request-id": "Airtime_1234567890",
                    "amount": 100,
                    "discount": 97,
                    "status": "success",
                    "message": "successfully purchase MTN VTU to 07013397088 , ₦100",
                    "phone_number": "07013397088",
                    "oldbal": "110225",
                    "newbal": 110128,
                    "system": "API",
                    "plan_type": "VTU",
                    "wallet_vending": "wallet"
                }

Cable Subscription API
Dashboard
Home

This section contains the recommended flow for integrating Cable Subscription services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB Cable Subscription Payment RESTful API, the endpoints below applies:

cable
iuc
cable_plan
bypass (boolean)
request-id (unique)
Cable ID
DSTV
2
GOTV
1
STARTIME
3
Dense padding
Rows per page:

5
1–3 of 3

Cable Plans
1
DSTV DStv Padi ₦4400
2
DSTV DSTV -YANGA ₦6000
4
DSTV DStv Compact ₦19000
6
DSTV DStv Asia ₦14900
7
DSTV DStv Compact Plus ₦30000
Dense padding
Rows per page:

5
1–5 of 59

PURCHASE PRODUCT

Using a POST method, Cable bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/cable
Code Sample

                $paypload = array(
                    'cable' => 1,
                     'iuc' => 09063503232,
                     'cable_plan' => 1,
                     'bypass' => false,
                     'request-id' => Cable_12345678900);
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/cable');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "cabl_name": "DSTV",
                    "request-id": "Cable_1234567890",
                    "amount": "12000",
                    "charges": 6000,
                    "status": "success",
                    "message": "successfully purchase DSTV joli joli ₦12000 to 0701339708866",
                    "iuc": "0701339708866",
                    "oldbal": "110128",
                    "newbal": 92128,
                    "system": "API",
                    "wallet_vending": "wallet",
                    "plan_name": "joli joli"
                }

Electricity Bill Subscription API
Dashboard
Home

This section contains the recommended flow for integrating Electricity Bill Subscription services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB Electricity Bill Subscription Payment RESTful API, the endpoints below applies:

disco
meter_type
meter_number
amount
bypass (boolean)
request-id (unique)
Disco ID
Ikeja Electricity
1
Eko Electricity
2
Kano Electricity
3
Port Harcourt Electricity
4
Joss Electricity
5
Dense padding
Rows per page:

5
1–5 of 11

PURCHASE PRODUCT

Using a POST method, Electricity Bill bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/bill
Code Sample

                $paypload = array(
                    'disco' => 1,
                     'meter_type' => 'prepaid',
                     'meter_number' => 09063503232,
                     'amount' => 300
                     'bypass' => false,
                     'request-id' => Bill_12345678900);
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/bill');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "disco_name": "ADEX DISO",
                    "request-id": "Bill_1234567890",
                    "amount": 300,
                    "charges": 21,
                    "status": "success",
                    "message": "Transaction  successful ADEX DISO PREPAID ₦300 to 0701339708866",
                    "meter_number": "0701339708866",
                    "meter_type": "POSTPAID",
                    "oldbal": "92128",
                    "newbal": 91807,
                    "system": "API",
                    "token" : ""
                    "wallet_vending": "wallet"
                }

Result Checker Subscription API
Dashboard
Home

This section contains the recommended flow for integrating Result Checker Subscription services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB Result Checker Subscription Payment RESTful API, the endpoints below applies:

exam
quantity
Exam ID
WAEC
1 ₦₦3,400.00
NECO
2 ₦₦2,120.00
NABTEB
3 ₦₦860.00
Dense padding
Rows per page:

5
1–3 of 3

PURCHASE PRODUCT

Using a POST method, Result Checker bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/exam
Code Sample

                $paypload = array(
                    'exam' => 1,
                     'quantity' => 1);
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/exam');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "username": "adex",
                    "amount": 100,
                    "quantity": 1,
                    "message": "WAEC Exam Pin Generated",
                    "oldbal": "91807",
                    "newbal": 91807,
                    "date": "2022-09-08 03:58:27",
                    "status": "success",
                    "request-id": "RESULTCHECKER_63195a53157b3",
                    "pin": " pin1<=>seral1"
                }

BULKSMS Subscription API
Dashboard
Home

This section contains the recommended flow for integrating BULKSMS Subscription services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB BULKSMS Subscription Payment RESTful API, the endpoints below applies:

sender
number
message
PURCHASE PRODUCT

Using a POST method, BULKSMS bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/bulksms
Code Sample

                $paypload = array(
                    'sender' => 'API',
                     'number' => 09063503232,
                     'message' => 'Adex Loves You');
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/bulksms');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "amount": 100,
                    "newbal": 91607,
                    "oldbal": "91707",
                    "plan_date": "2022-09-08 04:10:58",
                    "request-id": "BULKSMS_63195d3fcf35b",
                    "status": "success",
                    "correct_number": "07013397088",
                    "wrong_number": "",
                    "total_number": 1,
                    "total_correct_number": 1,
                    "total_wrong_number": 0,
                    "message": "messages sent to 1 phone numbers",
                    "sender_name": "API",
                    "numbers": "07013397088"
                }

IUC Verification API
Dashboard
Home

This section contains the recommended flow for integrating IUC Verification services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB IUC Verification Payment RESTful API, the endpoints below applies:

iuc
cable
Cable ID
DSTV
2
GOTV
1
STARTIME
3
Dense padding
Rows per page:

5
1–3 of 3

VERIFY IUC NUMBER

Using a GET method, IUC Verification bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/cable/cable-validation?iuc=12345555&cable=1

Expected Response

                {
                    "status": "success",
                    "name": "ADEX DEVELOPER"
                }

Meter Number Verification API
Dashboard
Home

This section contains the recommended flow for integrating Meter Number Verification services on the BILALSADASUB RESTful API.

Available Endpoints

To integrate the BILALSADASUB Meter Number Verification Payment RESTful API, the endpoints below applies:

meter_type
disco
meter_number
Disco ID
Ikeja Electricity
1
Eko Electricity
2
Kano Electricity
3
Port Harcourt Electricity
4
Joss Electricity
5
Dense padding
Rows per page:

5
1–5 of 11

VERIFY METER NUMBER

Using a GET method, IUC Verification bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/bill/bill-validation?meter_number=12345555&disco=1&meter_type=postpaid

Expected Response

                {
                    "status": "success",
                    "name": "ADEX DEVELOPER"
                }

Data Card API
Dashboard
Home

This section contains the recommended flow for integrating Data Card services on the Bilalsadasub RESTful API.

Available Endpoints

To integrate the Bilalsadasub Data Card Subscription Payment RESTful API, the endpoints below applies:

network
plan_type
quantity
card_name
Network Plan
MTN
1
GLO
3
AIRTEL
2
9MOBILE
4
Dense padding
Rows per page:

5
1–4 of 4

Data Card Plans
1
MTN COOPERATE GIFTING 750MB *460*6*1# *323*1# ₦410.00 7 days
8
AIRTEL SME 500MB *347*119*pin# *140# ₦288.00 30days after redeeming
9
AIRTEL SME 1GB *347*119*pin# *140# ₦576.00 30days after redeeming
10
AIRTEL SME 2GB *347*119*pin# *140# ₦1,152.00 30days after redeeming
11
AIRTEL SME 5GB *347*119*pin# \*140# ₦2,880.00 30days after redeeming
Dense padding
Rows per page:

5
1–5 of 8

PURCHASE PRODUCT

Using a POST method, Data card bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/data_card
Code Sample

                $paypload = array(
                    'network' => 1,
                     'plan_type' => 1,
                     'quantity' => 2,
                     'card_name' => 'bishirtm101',
                       );
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/data_card');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "network": "MTN",
                    "request-id": "Data_card_6346d0932500a",
                    "amount": 200,
                    "quantity": "2",
                    "status": "success",
                    "message": "MTN Data Card Printing Successful",
                    "card_name": "bishirtm101",
                    "oldbal": "42686",
                    "newbal": 42486,
                    "system": "API",
                    "serial": "856073001_3,348311767_4",
                    "pin": "data_card_400mb,data_card_500mb",
                    "load_pin": "*1234#",
                    "check_balance": "*1234#"
                }

Recharge Card API
Dashboard
Home

This section contains the recommended flow for integrating Recharge Card services on the Bilalsadasub RESTful API.

Available Endpoints

To integrate the Bilalsadasub Recharge Card Subscription Payment RESTful API, the endpoints below applies:

network
plan_type
quantity
card_name
Network Plan
MTN
1
GLO
3
AIRTEL
2
9MOBILE
4
Dense padding
Rows per page:

5
1–4 of 4

Recharge Card Plans
1
MTN 100 *556# *556# ₦97.00
3
MTN 500 *555*pin# *556# ₦485.00
5
GLO 200 *777# *777# ₦196.00
6
GLO 500 *777# *777# ₦490.00
8
AIRTEL 200 *126*pin# *126\*pin# ₦196.00
Dense padding
Rows per page:

5
1–5 of 5

PURCHASE PRODUCT

Using a POST method, Recharge card bundle can with the endpoint below:

Enpoint URL

https://bilalsadasub.com/api/recharge_card
Code Sample

                $paypload = array(
                    'network' => 1,
                     'plan_type' => 1,
                     'quantity' => 2,
                     'card_name' => 'bishirtm101',
                       );
                     $ch = curl_init();
                     curl_setopt($ch, CURLOPT_URL, 'https://bilalsadasub.com/api/recharge_card');
                     curl_setopt($ch, CURLOPT_POST, 1);
                     curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($paypload));
                     curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                     $headers = [
                          "Authorization: Token 4b755b58cb0ce09ba4f9ec2f5f841e4114bdebfc64b48a0b87aac55414e3",
                         'Content-Type: application/json'
                     ];
                     curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                     $response = curl_exec($ch);
                     curl_close($ch);

Expected Response

                {
                    "network": "MTN",
                    "request-id": "Recharge_card_6346d0932500a",
                    "amount": 200,
                    "quantity": "2",
                    "status": "success",
                    "message": "MTN Recharge Card Printing Successful",
                    "card_name": "bishirtm101",
                    "oldbal": "42686",
                    "newbal": 42486,
                    "system": "API",
                    "serial": "856073001_3,348311767_4",
                    "pin": "123455666,122333333",
                    "load_pin": "*555*",
                    "check_balance": "*556##"
                }

Callback/Webhook API Integration
Dashboard
Home

This section contains the recommended flow for integrating BILALSADASUB Callback/Webhook services when using the BILALSADASUB RESTful API.

The webhook service enables BILALSADASUB to send your system an update on certain activities. Such activities will include:

Transaction status update

The is usually sent to a URL you will provide to us via your BILALSADASUB dashboard. Please see

IMPORTANT NOTES:

To receive the BILALSADASUB callback requests, the below refers:

Make sure to update your callback URL on your BILALSADASUB dashboard when logged in on the website.
The request data will come as a JSON with three parent keys: “request-id” , “status” and "response" (and maybe more)
The “request-id” parent key will send u back the unique request-id you sent us earlier.
The “status” parent key will define if the transaction is success or fail.
The “response” parent key means the API Response.

Expected Response

                {
                    "status": "success",
                    "request-id": "Data_12345678900",
                    "response" : "Yello! You have gifted 500MB to 2347013397088. Share link https://mtnapp.page.link/myMTNNGApp with 2347013397088 to download the new MyMTN app for exciting offers."
                }
