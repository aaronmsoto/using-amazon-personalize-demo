# Amazon Personalize Demo

This is a demo project to showcase fundamental Amazon Personalize capabilities via a web tier SPA, app tier API, and mocked DB tier (items exist as JSON data within the API app tier):
* Thanks to GroupLens and their "MovieLens 100K" movie review data used in this demo
* The SPA initially views NON-personalized static Item data.
* Viewing items from this NON-personalized view, calls Personalize API with only an Item ID.
* The UI also has 4 mocked Users available in the main nav to simulate SPA usage as different Users.
* Each User will cause a Personalize API call to retrieve personalized Item recommendations.
* Any Item viewed for a selected User will trigger a Personalize API call containing User+Item input.
* Diagnostic HTML textareas provide info to the API Requests and Responses.

### Folders:
* apiPersonalize: a folder containing a serverless facade API to broker the Personalize requests as well as a mocked Item database that is used to hydrate Personalize responses into a meaningful format.
* dataPersonalize: a folder containing the CSV data files used to populate Amazon Personalize
* webDemo: a folder containing a Javascript SPA that calls into the above API

### Important Files
* apiPersonalize/serverless.yml: YAML config file defining my API (API Gateway + Lambda)
* apiPersonalize/handler.js: NodeJS file containing my Lambda code for my API tier
* webDemo/index.html: An HTML/Javascript SPA built with Bootstrap 4.4, Jquery, and Handlebars

### Prerequisites (if you want to run this demo)

Create your own Personalize Solutions + Campaigns with two ARNs:\
(see https://aws.amazon.com/blogs/machine-learning/creating-a-recommendation-engine-using-amazon-personalize/)
* one Campaign for user-based recommendations based on an HRNN variant ML model
* another Campaign for purely item-based recommendations based on the SIMS ML model

Install Serverless Framework (serverless.com): `npm i -g serverless`

### Setup

1) Clone this repo and run `npm install`
2) Set two AWS SSM Parameter Store variables, one for each ARN described above
3) Reference your two SSM Parameter Store variables in the serverless.yml file
4) CD to the apiPersonalize folder and run `serverless deploy` to deploy
5) Host/Run the webDemo/index.html file

### Local Function Invocation for Testing (from apiPersonalize folder)

`serverless invoke local -f GetRecommendationsByUser -p testeventByUser.json`\
`serverless invoke local -f GetRecommendationsByItem -p testeventByItem.json`\
`serverless invoke local -f GetRecommendationsByUserItem -p testeventByUserItem.json`

### API Deployment (from apiPersonalize folder)

`serverless deploy`

### WebUI SPA Deployment (from webDemo folder)

`aws s3 sync . s3://publicweb-using-amazon-personalize-demo/ --acl public-read`\
(replace **publicweb-using-amazon-personalize-demo** with whatever target bucket you're using)