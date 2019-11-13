#!/bin/bash


# check if there are two command line arguments
if [ "$#" -lt 2 ]; then
  echo "Sets artifactory credentials in all relevant files"
  echo "Usage: $0 ARTIFACTORY_USER_NAME ARTIFACTORY_USER_KEY <.npmrc destination>" >&2
  exit 1
fi

# create .npmrc at project root to set artifactory as registry
cp .npmrc.template .npmrc
NPM_AUTH=$(echo -n $1:$2 | base64) && sed -i.bak 's/${NPM_AUTH}/'$NPM_AUTH'/g' .npmrc

if [ "$#" -eq 3 ]; then
  echo "copying .npmrc to: "$3

  cp .npmrc $3/.npmrc
else
  echo "copying .npmrc to public folder"

  cp .npmrc public/.npmrc
fi
