# Azure GitHub Actions: OIDC instead of `AZURE_CREDENTIALS`

The `azure-deploy` workflow currently uses `azure/login@v2` with `creds: ${{ secrets.AZURE_CREDENTIALS }}` (JSON service principal).

To migrate to OIDC (no long-lived client secret):

1. In Microsoft Entra ID, create an App Registration federated credential for `repo:ORG/REPO:environment:production` (or branch-based subject).
2. Create secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
3. Replace the login step with:

```yaml
- uses: azure/login@v2
  with:
    client-id: ${{ secrets.AZURE_CLIENT_ID }}
    tenant-id: ${{ secrets.AZURE_TENANT_ID }}
    subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
```

4. Remove `AZURE_CREDENTIALS`.  
The `deploy-backend` job already sets `permissions: id-token: write` for this path.
