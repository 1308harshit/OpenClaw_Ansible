$pemPath = 'C:\Pratik\Freelancing\Harshit_ansible\ansible-keypair.pem'
$acl = Get-Acl $pemPath
$acl.SetAccessRuleProtection($true, $false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, 'Read', 'Allow')
$acl.AddAccessRule($rule)
Set-Acl $pemPath $acl
Write-Host "Permissions fixed for $pemPath"
icacls $pemPath
