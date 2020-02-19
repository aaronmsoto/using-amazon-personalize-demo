# Amazon Personalize Demo

This is a demo project to showcase fundamental Amazon Personalize capabilities via a simple web SPA web:
* The SPA initially views NON-personalized static Item data.
* Viewing items from this NON-personalized view, calls Personalize API with only an Item ID.
* The UI also has 4 mocked Users available in the main nav to simulate SPA usage as different Users.
* Each User will cause a Personalize API call to retrieve personalized Item recommendations.
* Any Item viewed for a selected User will trigger a Personalize API call containing User+Item input.
* Diagnostic Textareas provide info to the API Requests and Responses.

Contents:
* apiPersonalize: a folder containing a serverless facade API to broker the Personalize requests as well as a mocked Product/Item database that is used to hydrate Personalize responses into a meaningful format.
* webDemo: a folder containing a simple javascript SPA that calls into the above API

### Prerequisites

Create your own Personalize Solutions + Campaigns with two ARNs:
* one for user-based recommendations based on an HRNN variant model
* another for item-based recommendations based on the SIMS model

Install Serverless Framework (serverless.com): `npm i -g serverless`

### Setup

1) Clone this repo and run `npm install`
2) Set two SSM Parameter Store variables, one for each ARN described above
3) Reference your two SSM Parameter Store variables in the serverless.yml file
4) CD to the apiPersonalize folder and run `serverless deploy` to deploy
5) Host/Run the webDemo/index.html file

### Important Files
* apiPersonalize/serverless.yml: YAML config file defining my API (API Gateway + Lambda)
* apiPersonalize/handler.js: NodeJS file containing my Lambda code
* webDemo/index.html: SPA built with HTML, Bootstrap 4.4, Javascript, Jquery, and CSS

### Local Function Invocation for Testing (from apiPersonalize folder)

`serverless invoke local -f GetRecommendationsByUser -p testeventByUser.json`\
`serverless invoke local -f GetRecommendationsByItem -p testeventByItem.json`\
`serverless invoke local -f GetRecommendationsByUserItem -p testeventByUserItem.json`

### Deployment (from apiPersonalize folder)

`serverless deploy`
